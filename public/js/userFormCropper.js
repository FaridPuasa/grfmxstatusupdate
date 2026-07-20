// Shared profile-picture cropper for createUser.ejs and updateUser.ejs.
// updateUser.ejs has a #removeProfilePicture hidden flag (to tell the server
// an existing picture was explicitly cleared) that createUser.ejs has no use
// for since there's no existing picture yet - guarded so this same script
// works correctly on both pages.

let cropper = null;
let currentFile = null;

function removeProfilePicture() {
    document.getElementById('profilePicture').value = '';
    const removeFlag = document.getElementById('removeProfilePicture');
    if (removeFlag) removeFlag.value = '1';
    const container = document.getElementById('profileImageContainer');
    if (container) {
        container.innerHTML = '';
    }
}

function openCropper(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = function (e) {
        const image = document.getElementById('cropperImage');
        image.src = e.target.result;
        document.getElementById('cropperModal').style.display = 'flex';

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(image, {
            aspectRatio: 1, // Square for profile picture
            viewMode: 2,
            dragMode: 'move',
            cropBoxMovable: true,
            cropBoxResizable: true,
            zoomable: true,
            zoomOnWheel: true,
            zoomOnTouch: true,
            scalable: true,
            rotatable: true,
            background: true,
            guides: true,
            center: true,
            highlight: true,
            autoCrop: true,
            autoCropArea: 1,
            responsive: true,
            restore: true,
            checkCrossOrigin: true,
            checkOrientation: true,
            modal: true
        });
    };
    reader.readAsDataURL(file);
}

function cropImage() {
    if (cropper) {
        const canvas = cropper.getCroppedCanvas({
            width: 200,
            height: 200,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        const croppedImage = canvas.toDataURL('image/jpeg', 0.9);
        document.getElementById('profilePicture').value = croppedImage;
        const removeFlag = document.getElementById('removeProfilePicture');
        if (removeFlag) removeFlag.value = '0';

        // Update preview
        const container = document.getElementById('profileImageContainer');
        container.innerHTML = '';

        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        const preview = document.createElement('img');
        preview.className = 'profile-preview';
        preview.src = croppedImage;
        preview.alt = 'Profile Preview';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-image-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', removeProfilePicture);

        imageContainer.appendChild(preview);
        imageContainer.appendChild(removeBtn);
        container.appendChild(imageContainer);

        closeCropper();
    }
}

function closeCropper() {
    document.getElementById('cropperModal').style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}
