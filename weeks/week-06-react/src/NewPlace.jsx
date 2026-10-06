import { useEffect, useId, useRef, useState } from 'react'
import { findCity, suggest } from './cities.js'
import { preparePhoto } from './mine.js'
import Photo from './Photo.jsx'

// The New dialog: a photo in the middle, the place it was taken below it, and
// Save. The place has to be one from the list, since that is what gives the
// card its time zone and its sunrise and sunset. It is mounted only while
// open, so every opening starts blank; closing plays its exit first, then
// tells the wall it can go (see the modal styles in App.css).
export default function NewPlace({ onClose, onSave, existing }) {
  const dialogRef = useRef(null)
  const fileRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()

  const [photo, setPhoto] = useState(null) // { blob, url, crop, cropX, look }
  const [query, setQuery] = useState('')
  const [city, setCity] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)

  const close = () => setClosing(true)

  // Unmount once the exit has played -- or straight away, should the
  // animation never run (a hidden tab).
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(onClose, 400)
    return () => clearTimeout(t)
  }, [closing, onClose])

  const options = city ? [] : suggest(query)
  const showList = listOpen && options.length > 0

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])

  const takeFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file isn’t an image.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const p = await preparePhoto(file)
      setPhoto({ ...p, url: URL.createObjectURL(p.blob) })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const choose = (c) => {
    setCity(c)
    setQuery(c.label)
    setListOpen(false)
  }

  const onType = (e) => {
    const v = e.target.value
    setQuery(v)
    setCity(findCity(v))
    setActive(0)
    setListOpen(true)
  }

  const onKey = (e) => {
    if (!showList) {
      if (e.key === 'ArrowDown' && options.length) {
        e.preventDefault()
        setListOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault()
      choose(options[active])
    } else if (e.key === 'Escape') {
      // Close the list, not the whole dialog.
      e.preventDefault()
      e.stopPropagation()
      setListOpen(false)
    }
  }

  const canSave = photo && city && !busy
  // Picking a city that already has a card adds this photo to it.
  const joins = city ? existing(city) : null

  const save = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    try {
      await onSave({
        id: `mine-${Date.now()}`,
        added: Date.now(),
        label: city.label,
        timeZone: city.timeZone,
        lat: city.lat,
        lng: city.lng,
        blob: photo.blob,
        crop: photo.crop,
        cropX: photo.cropX,
        look: photo.look,
      })
      close()
    } catch {
      setError('Couldn’t save that here -- is this a private window?')
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={closing ? 'modal is-closing' : 'modal'}
      aria-labelledby={`${listId}-title`}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === dialogRef.current && close()}
      onAnimationEnd={(e) => e.target === dialogRef.current && closing && onClose()}
    >
      <form className="modal-body" onSubmit={save}>
        <h2 id={`${listId}-title`} className="place">
          New place
        </h2>

        <button
          type="button"
          className={`drop${dragging ? ' is-over' : ''}${photo ? ' has-photo' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            takeFile(e.dataTransfer.files[0])
          }}
          aria-label={photo ? 'Change photo' : 'Add a photo'}
        >
          {photo ? (
            <Photo src={photo.url} crop={photo.crop} cropX={photo.cropX} />
          ) : (
            <span className="drop-hint">
              <span className="plus" aria-hidden="true">+</span>
              {busy ? 'Reading…' : 'Add a photo'}
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            takeFile(e.target.files[0])
            e.target.value = ''
          }}
        />

        <div className="combo">
          <input
            ref={inputRef}
            className="field"
            type="text"
            placeholder="City, country"
            autoComplete="off"
            spellCheck="false"
            value={query}
            onChange={onType}
            onKeyDown={onKey}
            onFocus={() => setListOpen(true)}
            onBlur={() => setListOpen(false)}
            role="combobox"
            aria-label="Where it was taken: city, country"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          />
          {showList && (
            <ul className="suggestions" id={listId} role="listbox">
              {options.map((c, i) => (
                <li
                  key={c.label}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'is-active' : undefined}
                  onMouseEnter={() => setActive(i)}
                  // Before the input's blur, or the list is gone by the click.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(c)
                  }}
                >
                  <span>{c.city}</span>
                  <span className="country">{c.country}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="modal-note" role="status">
          {error ||
            (joins
              ? `Adds to your ${joins.split(',')[0]} card.`
              : query && !city && !showList
                ? 'Pick a place from the list.'
                :' ')}
        </p>

        <button type="submit" className="save" disabled={!canSave}>
          {joins ? 'Add photo' : 'Save'}
        </button>
      </form>
    </dialog>
  )
}
