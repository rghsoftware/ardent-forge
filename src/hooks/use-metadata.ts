import { useEffect } from 'react'

interface MetadataOptions {
  title?: string
  description?: string
  ogImage?: string
}

const DEFAULT_TITLE = 'Ardent Forge'
const DEFAULT_DESCRIPTION =
  'Track workouts, build programs, and forge your fitness path with Ardent Forge.'
const DEFAULT_OG_IMAGE = '/logos/fulllogo.png'

function setMetaTag(property: string, content: string, attribute: 'property' | 'name' = 'property') {
  const selector = `meta[${attribute}="${property}"]`
  let element = document.querySelector<HTMLMetaElement>(selector)
  if (element) {
    element.content = content
  } else {
    element = document.createElement('meta')
    element.setAttribute(attribute, property)
    element.content = content
    document.head.appendChild(element)
  }
}

/**
 * Sets the document title and updates Open Graph / Twitter Card meta tags.
 * Resets to defaults on unmount so stale metadata is never left behind.
 */
export function useMetadata({ title, description, ogImage }: MetadataOptions = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | Ardent Forge` : DEFAULT_TITLE
    const desc = description ?? DEFAULT_DESCRIPTION
    const image = ogImage ?? DEFAULT_OG_IMAGE

    document.title = fullTitle

    setMetaTag('description', desc, 'name')
    setMetaTag('og:title', fullTitle)
    setMetaTag('og:description', desc)
    setMetaTag('og:image', image)
    setMetaTag('twitter:title', fullTitle)
    setMetaTag('twitter:description', desc)
    setMetaTag('twitter:image', image)

    return () => {
      document.title = DEFAULT_TITLE
      setMetaTag('description', DEFAULT_DESCRIPTION, 'name')
      setMetaTag('og:title', DEFAULT_TITLE)
      setMetaTag('og:description', DEFAULT_DESCRIPTION)
      setMetaTag('og:image', DEFAULT_OG_IMAGE)
      setMetaTag('twitter:title', DEFAULT_TITLE)
      setMetaTag('twitter:description', DEFAULT_DESCRIPTION)
      setMetaTag('twitter:image', DEFAULT_OG_IMAGE)
    }
  }, [title, description, ogImage])
}
