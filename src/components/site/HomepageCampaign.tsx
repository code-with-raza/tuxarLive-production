import { cloudinaryUrl } from "@/lib/cloudinary";
import { campaignImageSources, homepageBannerFromRow } from "@/lib/homepage-campaign";

export function HomepageCampaign({
  campaign,
  onError,
}: {
  campaign: NonNullable<ReturnType<typeof homepageBannerFromRow>>;
  onError?: () => void;
}) {
  return (
    <section aria-label={campaign.title} className="bg-[#f6eee2]">
      <a
        href={campaign.href}
        aria-label={`${campaign.title}. ${campaign.cta}`}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-black"
      >
        <h1 className="sr-only">{campaign.title}</h1>
        <img
          src={
            campaign.image.startsWith("https://res.cloudinary.com/")
              ? cloudinaryUrl(campaign.image, { width: 1920, crop: "fit" })
              : campaign.image
          }
          srcSet={campaignImageSources(campaign.image)}
          sizes="100vw"
          width={campaign.width}
          height={campaign.height}
          alt={campaign.alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={onError}
          className="block h-auto w-full"
        />
        <div className="px-6 py-5 text-center text-zinc-950 md:hidden">
          <p aria-hidden="true" className="font-display text-3xl">
            {campaign.title}
          </p>
          {campaign.cta && (
            <span className="mt-3 inline-flex min-h-12 items-center justify-center bg-[#b54d24] px-7 text-sm uppercase tracking-widest text-white">
              {campaign.cta}{" "}
              <span aria-hidden="true" className="ml-3">
                →
              </span>
            </span>
          )}
        </div>
      </a>
    </section>
  );
}
