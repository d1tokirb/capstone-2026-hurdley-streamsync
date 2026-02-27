// Find the main video element
// Strategy: Find the largest video element on page or the first one
// Recursively search for video elements, including within Shadow DOMs
function findVideoInTree(root) {
    let video = root.querySelector('video');
    if (video) return video;

    // Check all child elements for shadow roots
    const allElements = root.querySelectorAll('*');
    for (let el of allElements) {
        if (el.shadowRoot) {
            video = findVideoInTree(el.shadowRoot);
            if (video) return video;
        }
    }
    return null;
}

// Strategy: Find the largest video element on page or the first one
function findVideo() {
    // Basic query selectors might miss shadow connection, so we use the recursive search
    // But for performance, maybe we try basic first? 
    // Actually, let's just do a deep search if querySelectorAll fails or maybe always for robustness?
    // Let's stick to the prompt's Shadow DOM requirement.

    // First, try standard videos because they are faster
    let videos = Array.from(document.querySelectorAll('video'));

    // If none found, or maybe even if found, we should check shadow roots?
    // Crunchyroll likely has it in Shadow DOM.
    if (videos.length === 0) {
        const shadowVideo = findVideoInTree(document);
        if (shadowVideo) videos.push(shadowVideo);
    }

    if (videos.length === 0) return null;

    // Return video with largest area
    return videos.reduce((prev, curr) => {
        const prevRect = prev.getBoundingClientRect();
        const currRect = curr.getBoundingClientRect();
        const prevArea = prevRect.width * prevRect.height;
        const currArea = currRect.width * currRect.height;
        return currArea > prevArea ? curr : prev;
    });
}

let video = findVideo();
let isRemoteUpdate = false; // Flag to prevent infinite loops
let isAdPlaying = false;

// If valid video found, attach listeners
if (video) {
    console.log('StreamSync: Video found', video);
    attachListeners(video);
    checkForAds();
} else {
    // Observer to watch for dynamically added videos
    const observer = new MutationObserver(() => {
        const v = findVideo();
        if (v && v !== video) {
            video = v;
            console.log('StreamSync: New video found', video);
            attachListeners(video);
            checkForAds();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

let adCheckInterval = null;

function checkForAds() {
    // YouTube specific ad detection: only start one interval per frame
    if (location.hostname.includes('youtube.com')) {
        if (adCheckInterval) return; // Already checking for ads

        const checkAd = () => {
            const adShowing = document.querySelector('.ad-showing') || document.querySelector('.ad-interrupting');
            if (adShowing && !isAdPlaying) {
                isAdPlaying = true;
                console.log('StreamSync: Ad started');
                chrome.runtime.sendMessage({ action: 'ad-start' });
            } else if (!adShowing && isAdPlaying) {
                isAdPlaying = false;
                console.log('StreamSync: Ad ended, waiting to resume...');

                // Allow the video player a moment to restore the real video, then auto-play the room
                setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'ad-end' });

                    if (video) {
                        if (video.paused) {
                            video.play().catch(e => console.error("Ad resume blocked:", e));
                        }
                        // Broadcast state manually since sendEvent is out of scope here
                        chrome.runtime.sendMessage({
                            action: 'video-event',
                            data: {
                                type: 'play',
                                time: video.currentTime,
                                timestamp: Date.now()
                            }
                        }).catch(e => { });
                    }
                }, 1000);
            }
        };

        // Check quickly to catch initial ads before others start playing
        adCheckInterval = setInterval(checkAd, 200);
        checkAd();
    }
}

function attachListeners(v) {
    function sendEvent(type) {
        if (isRemoteUpdate || isAdPlaying) return;

        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
            console.log('StreamSync: Extension context invalidated. Detaching listeners.');
            v.removeEventListener('play', playHandler);
            v.removeEventListener('pause', pauseHandler);
            v.removeEventListener('seeked', seekHandler);
            return;
        }

        console.log('Sending event:', type, v.currentTime);
        try {
            chrome.runtime.sendMessage({
                action: 'video-event',
                data: {
                    type: type,
                    time: v.currentTime,
                    timestamp: Date.now()
                }
            }).catch(err => {
                console.log('StreamSync: Message failed (polite ignore):', err.message);
            });
        } catch (e) {
            console.log('StreamSync: Context invalid during send:', e.message);
        }
    }

    const playHandler = () => sendEvent('play');
    const pauseHandler = () => sendEvent('pause');
    const seekHandler = () => {
        clearTimeout(seekTimeout);
        seekTimeout = setTimeout(() => {
            sendEvent('seek');
        }, 100);
    };

    v.addEventListener('play', playHandler);
    v.addEventListener('pause', pauseHandler);

    let seekTimeout;
    v.addEventListener('seeked', seekHandler);
}

// Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sync-video' && video) {
        if (isAdPlaying) return;

        const { type, time } = message.data;
        const threshold = message.syncSensitivity || 0.5;
        console.log('Received remote command:', type, time, 'threshold:', threshold);

        isRemoteUpdate = true;

        if (time !== null && time !== undefined && Math.abs(video.currentTime - time) > threshold) {
            video.currentTime = time;
        }

        if (type === 'play') {
            video.play().catch(e => {
                console.warn("StreamSync: Autoplay blocked. Trying muted autoplay...", e);
                // Fallback: Muted autoplay
                video.muted = true;
                video.play().then(() => {
                    console.log("StreamSync: Muted autoplay successful. Unmuting...");
                    // Optional: Try to unmute immediately? Browsers might block this too.
                    // video.muted = false; 
                }).catch(err => console.error("StreamSync: Muted autoplay also failed:", err));
            });
        } else if (type === 'pause') {
            video.pause();
        } else if (type === 'seek') {
            video.currentTime = time;
        }

        setTimeout(() => {
            isRemoteUpdate = false;
        }, 500);
    }
});
