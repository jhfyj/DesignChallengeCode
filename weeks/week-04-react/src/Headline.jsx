import { useMemo } from 'react'
import { foamMaskStyle } from './foamMask'

export const HEADLINE_LABEL = 'Since when was the last time you had some fun?'

export default function Headline({ mask }) {
  const style = useMemo(() => foamMaskStyle(mask), [mask])

  return (
    <div className="headline-layer" style={style}>
      <h1 className="headline" aria-label={HEADLINE_LABEL}>
        <span className="headline-line">Since when was</span>
        <span className="headline-line">the last time you</span>
        <span className="headline-line">
          had some <em>fun?</em>
        </span>
      </h1>
    </div>
  )
}
