import { ADS, AdId } from '@/lib/ads'

export function AdBanner({ id }: { id: AdId }) {
  const ad = ADS[id]
  return (
    <div className="flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href={ad.href} rel="nofollow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={ad.image.width}
          height={ad.image.height}
          alt=""
          src={ad.image.src}
          style={{ border: 0 }}
        />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        width={1}
        height={1}
        src={ad.tracking.src}
        alt=""
        style={{ border: 0 }}
      />
    </div>
  )
}
