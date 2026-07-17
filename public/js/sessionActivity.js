(function () {
    var IDLE_LIMIT_MS = 60 * 60 * 1000; // must match SESSION_IDLE_TIMEOUT_MS in index.js
    var CHECK_INTERVAL_MS = 60 * 1000;
    var lastActivity = Date.now();
    var pinging = false;

    function markActivity() {
        lastActivity = Date.now();
    }

    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll', 'scan'].forEach(function (evt) {
        document.addEventListener(evt, markActivity, { passive: true });
    });

    setInterval(function () {
        var idleFor = Date.now() - lastActivity;

        if (idleFor >= IDLE_LIMIT_MS) {
            window.location.href = '/logout';
            return;
        }

        // Only ping the server if there was activity since the last check,
        // so a genuinely idle tab is allowed to expire naturally.
        if (idleFor < CHECK_INTERVAL_MS && !pinging) {
            pinging = true;
            fetch('/session/heartbeat', { method: 'POST', credentials: 'same-origin' })
                .catch(function () {})
                .finally(function () { pinging = false; });
        }
    }, CHECK_INTERVAL_MS);
})();
