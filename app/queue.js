var queue = {
    // if currently in queue
    queued: false,

    // offer URL, or false if no offer
    offer: false,

    // timestamp of offer end, or 0 if no offer
    time: 0,

    // protection code, or false if no offer
    protectionCode: false,
    tabOpened: false
};

/**
 * Listen here for any changes in auto-accepting
 */

// init
$(document).ready(function() {
    var queueElm = document.getElementById('queue');
    if (!queueElm) {
        return;
    }

    queue.queued = true;

    // create observer for queue element
    var obs = new MutationObserver(function(records) {
        for (var i = 0; i < records.length; ++i) {
            var record = records[i];
            if (!record.type === 'childList' || !record.addedNodes) {
                continue;
            }

            // loop through every added node
            for (var j = 0, k = record.addedNodes.length; j < k; ++j) {
                var elm = record.addedNodes[j];

                // protection code
                if (elm.nodeName === 'B') {
                    queue.protectionCode = elm.textContent || false;
                    continue;
                }

                // time left
                if (['timeret', 'timebet'].indexOf(elm.id) !== -1) {
                    var time = parseInt(elm.textContent);

                    time = time ? Date.now() + time * 1000 : 0;

                    queue.time = time;
                }

                // other than protection code/time, we're only interested in links
                if (elm.nodeName !== 'A') {
                    continue;
                }

                // link to offer
                if (elm.className === 'button') {
                    queue.offer = elm.href || false;
                }
            }
        }

        // save queue data to storage
        chrome.storage.local.set({queue: queue}, function() {
            if (queue.tabOpened) {
                return;
            }

            if (!queue.offer) {
                return;
            }

            queue.tabOpened = true;

            chrome.runtime.sendMessage({queue: queue});
        });
    });

    obs.observe(queueElm, {
        childList: true
    });
});
