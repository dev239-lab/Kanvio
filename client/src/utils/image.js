// Turns a chosen picture into a small square JPEG (a data URL) that is cheap to store.
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB picked from the computer
const MAX_RESULT_CHARS = 60000; // keeps the saved picture small

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as a picture.'));
    };
    img.src = url;
  });
}

export async function pictureToDataUrl(file, size = 256) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('Please choose a JPG, PNG or WebP picture.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That picture is larger than 8 MB. Please choose a smaller one.');
  }

  const img = await loadImage(file);

  // Crop the middle square, then shrink it
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white instead of black
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  // Lower the quality until it is small enough
  for (let quality = 0.85; quality >= 0.4; quality -= 0.15) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_RESULT_CHARS) return dataUrl;
  }
  throw new Error('That picture is too detailed to shrink. Please try another one.');
}