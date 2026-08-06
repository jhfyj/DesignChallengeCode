import { useRef, useState } from 'react'
import { Add, Close } from '@carbon/icons-react'
import { useDesignState } from '../../state/DesignContext.jsx'
import { fileToDataUrl } from '../../utils/fileToDataUrl.js'
import ImageUpload from './ImageUpload.jsx'
import Folder from './Folder.jsx'
import ToggleRow from './ToggleRow.jsx'
import SliderRow from './SliderRow.jsx'
import SpeakerRow from './SpeakerRow.jsx'

function emptySpeaker() {
  return { image: null, title: '', role: '', company: '' }
}

export default function ImageSection() {
  const { image, updateImage, setBackgroundImage, setSelectedKey } = useDesignState()
  const { backgroundImage, speakersOn, speakers, images } = image
  const [expandedSpeaker, setExpandedSpeaker] = useState(null)
  const galleryInputRef = useRef(null)

  function handleBackgroundChange(value) {
    setBackgroundImage(value)
    setSelectedKey(value ? 'background' : null)
  }

  function setSpeakersOn(v) {
    updateImage({ speakersOn: v })
  }

  function setSpeakerCount(count) {
    const next = speakers.slice(0, count)
    while (next.length < count) next.push(emptySpeaker())
    updateImage({ speakers: next })
    if (expandedSpeaker !== null && expandedSpeaker >= count) setExpandedSpeaker(null)
  }

  function updateSpeaker(index, patch) {
    updateImage({ speakers: speakers.map((s, i) => (i === index ? { ...s, ...patch } : s)) })
    // The placement only exists once the speaker has an image (see
    // fieldSelectors.js) — select it on the image being set, or on any
    // further edit (caption text) once it's already placed.
    const hasImage = 'image' in patch ? patch.image != null : speakers[index].image != null
    setSelectedKey(hasImage ? `speaker-${index}` : null)
  }

  function toggleSpeaker(index) {
    setExpandedSpeaker((current) => (current === index ? null : index))
  }

  async function handleGalleryAdd(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const id = `${file.name}-${Date.now()}-${Math.random()}`
    const url = await fileToDataUrl(file)
    updateImage({ images: [...images, { id, file, url }] })
    setSelectedKey(`image-${id}`)
  }

  function removeGalleryImage(id) {
    updateImage({ images: images.filter((img) => img.id !== id) })
  }

  return (
    <>
      <Folder title="Layout">
        <ImageUpload label="Background Image" value={backgroundImage} onChange={handleBackgroundChange} />

        <ToggleRow label="Speakers" value={speakersOn} onChange={setSpeakersOn} />
        {speakersOn && (
          <>
            <SliderRow
              label="Number of speakers"
              value={speakers.length}
              min={1}
              max={5}
              onChange={setSpeakerCount}
              showFill={false}
            />

            {speakers.map((speaker, i) => (
              <SpeakerRow
                key={i}
                index={i}
                speaker={speaker}
                expanded={expandedSpeaker === i}
                onToggle={() => toggleSpeaker(i)}
                onChange={(patch) => updateSpeaker(i, patch)}
              />
            ))}
          </>
        )}
      </Folder>

      <Folder title="Image">
        <div className="image-gallery__header">
          <button type="button" className="image-gallery__add" onClick={() => galleryInputRef.current?.click()}>
            <Add size={14} />
            Add
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="image-upload__input"
            onChange={handleGalleryAdd}
          />
        </div>
        {images.map((img) => (
          <div key={img.id} className="field-row image-gallery__row">
            <img src={img.url} alt="" className="image-upload__thumb" />
            <span className="image-upload__name">{img.file?.name || 'Image'}</span>
            <button
              type="button"
              className="image-upload__remove image-gallery__remove"
              onClick={() => removeGalleryImage(img.id)}
              aria-label="Remove image"
            >
              <Close size={14} />
            </button>
          </div>
        ))}
      </Folder>
    </>
  )
}
