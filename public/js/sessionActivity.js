(function () {
    var IDLE_LIMIT_MS = 60 * 60 * 1000; // must match SESSION_IDLE_TIMEOUT_MS in index.js
    var WARNING_BEFORE_MS = 60 * 1000; // show the "still there?" prompt this long before logout
    var HEARTBEAT_INTERVAL_MS = 60 * 1000;
    var TICK_MS = 1000; // fine-grained so the warning countdown updates smoothly

    var lastActivity = Date.now();
    var lastHeartbeatCheck = Date.now();
    var pinging = false;
    var warningShown = false;
    var loggedOut = false;
    var overlay, countdownEl;

    function markActivity() {
        lastActivity = Date.now();
        if (warningShown) {
            hideWarning();
        }
    }

    // Only count activity that happens outside the warning prompt itself as "still there" -
    // once the prompt is up, extending the session requires an explicit choice.
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll', 'scan'].forEach(function (evt) {
        document.addEventListener(evt, function (e) {
            if (overlay && overlay.contains(e.target)) return;
            markActivity();
        }, { passive: true });
    });

    function sendHeartbeat() {
        return fetch('/session/heartbeat', { method: 'POST', credentials: 'same-origin' }).catch(function () {});
    }

    function buildOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'idle-logout-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
            'z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:inherit;';

        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;color:#212529;border-radius:8px;padding:24px 28px;' +
            'max-width:360px;width:90%;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;';

        var title = document.createElement('div');
        title.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:10px;';
        title.textContent = 'Are you still there?';

        var msg = document.createElement('div');
        msg.style.cssText = 'font-size:14px;margin-bottom:16px;color:#495057;';
        countdownEl = document.createElement('span');
        countdownEl.style.fontWeight = '600';
        msg.appendChild(document.createTextNode('You will be logged out in '));
        msg.appendChild(countdownEl);
        msg.appendChild(document.createTextNode(' due to inactivity.'));

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;';

        var stayBtn = document.createElement('button');
        stayBtn.type = 'button';
        stayBtn.textContent = 'Stay logged in';
        stayBtn.style.cssText = 'background:#0d6efd;color:#fff;border:none;padding:8px 16px;' +
            'border-radius:6px;cursor:pointer;font-size:14px;';
        stayBtn.addEventListener('click', function () {
            markActivity();
            sendHeartbeat();
        });

        var logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.textContent = 'Log out';
        logoutBtn.style.cssText = 'background:#e9ecef;color:#212529;border:none;padding:8px 16px;' +
            'border-radius:6px;cursor:pointer;font-size:14px;';
        logoutBtn.addEventListener('click', doLogout);

        btnRow.appendChild(stayBtn);
        btnRow.appendChild(logoutBtn);
        box.appendChild(title);
        box.appendChild(msg);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    function showWarning() {
        warningShown = true;
        if (!overlay) buildOverlay();
        overlay.style.display = 'flex';
    }

    function hideWarning() {
        warningShown = false;
        if (overlay) overlay.style.display = 'none';
    }

    function doLogout() {
        if (loggedOut) return;
        loggedOut = true;
        window.location.href = '/logout';
    }

    setInterval(function () {
        if (loggedOut) return;

        var now = Date.now();
        var idleFor = now - lastActivity;
        var remaining = IDLE_LIMIT_MS - idleFor;

        if (remaining <= 0) {
            doLogout();
            return;
        }

        if (remaining <= WARNING_BEFORE_MS) {
            showWarning();
            countdownEl.textContent = Math.ceil(remaining / 1000) + 's';
        }

        // Only ping the server if there was activity since the last check,
        // so a genuinely idle tab is allowed to expire naturally.
        if (now - lastHeartbeatCheck >= HEARTBEAT_INTERVAL_MS) {
            if (idleFor < HEARTBEAT_INTERVAL_MS && !pinging) {
                pinging = true;
                sendHeartbeat().finally(function () { pinging = false; });
            }
            lastHeartbeatCheck = now;
        }
    }, TICK_MS);
})();
