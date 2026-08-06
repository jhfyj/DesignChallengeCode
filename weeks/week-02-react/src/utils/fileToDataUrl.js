// Reads a File as a base64 data: URL rather than URL.createObjectURL's
// blob: URL — html-to-image's clone/embed pipeline (used for canvas export)
// doesn't resolve blob: URLs correctly, silently producing a broken image.
// data: URLs are self-contained and survive that pipeline untouched.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
