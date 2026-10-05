import { Avatar } from '@skeleton/ui'
import styles from './sections.module.css'

export type TestimonialProps = {
  quote: string
  author: string
  /** 직함 · 소속 */
  role?: string
  avatarSrc?: string
}

/** 고객의 한마디 — `figure` · `blockquote` · `figcaption`(누가 말했나) */
export function Testimonial({ quote, author, role, avatarSrc }: TestimonialProps) {
  return (
    <figure className={styles.testimonial}>
      <blockquote className={styles.quote}>
        <p>{quote}</p>
      </blockquote>
      <figcaption className={styles.caption}>
        <Avatar name={author} src={avatarSrc} alt="" />
        <span>
          <strong>{author}</strong>
          {role && <span className={styles.role}> {role}</span>}
        </span>
      </figcaption>
    </figure>
  )
}
