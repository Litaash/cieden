import type { MetadataRoute } from 'next';

/**
 * Block all crawlers. This is a take-home project, not intended for
 * public indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
