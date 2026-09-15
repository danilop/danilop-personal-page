import {site} from '../data';
export function GET(){return new Response(site.isPreview ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\nSitemap: https://www.danilop.net/sitemap.xml\n");}
