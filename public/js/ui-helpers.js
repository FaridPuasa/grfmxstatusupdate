// Shared non-blocking replacements for window.alert()/window.confirm(), built on
// Bootstrap 5's Toast and Modal components. Requires the toast container
// (#uiToastContainer) and confirm modal (#uiConfirmModal) markup from
// partials/navbar.ejs to be present on the page, and bootstrap.bundle.min.js
// to be loaded before these are called.

/**
 * Show a transient, non-blocking notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} [type='info']
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('uiToastContainer');
    if (!container || typeof bootstrap === 'undefined') {
        window.alert(message);
        return;
    }

    const bgClass = {
        success: 'text-bg-success',
        error: 'text-bg-danger',
        warning: 'text-bg-warning',
        info: 'text-bg-primary'
    }[type] || 'text-bg-primary';

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgClass} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body"></div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>`;
    toastEl.querySelector('.toast-body').textContent = message;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 6000 });
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    toast.show();
}

/**
 * Promise-based replacement for window.confirm(). Resolves true if the user
 * clicks the confirm button, false if they cancel/dismiss/close the modal.
 * @param {string} message
 * @param {{title?: string, okText?: string, okClass?: string}} [opts]
 * @returns {Promise<boolean>}
 */
function showConfirm(message, opts = {}) {
    const { title = 'Please Confirm', okText = 'Confirm', okClass = 'btn-danger' } = opts;

    return new Promise((resolve) => {
        const modalEl = document.getElementById('uiConfirmModal');
        if (!modalEl || typeof bootstrap === 'undefined') {
            resolve(window.confirm(message));
            return;
        }

        modalEl.querySelector('#uiConfirmModalTitle').textContent = title;
        modalEl.querySelector('#uiConfirmModalBody').textContent = message;
        const okBtn = modalEl.querySelector('#uiConfirmModalOk');
        okBtn.textContent = okText;
        okBtn.className = `btn ${okClass}`;

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        let resolved = false;

        function finish(result) {
            if (resolved) return;
            resolved = true;
            okBtn.removeEventListener('click', onOk);
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
            resolve(result);
        }
        function onOk() { modal.hide(); finish(true); }
        function onHidden() { finish(false); }

        okBtn.addEventListener('click', onOk);
        modalEl.addEventListener('hidden.bs.modal', onHidden);
        modal.show();
    });
}
