# danilop-personal-page

![Sample personal page](https://danilop.s3.amazonaws.com/Images/danilop-personal-page.png)

A simple script to populate a web page with links, retrieving link info using the Open Graph protocol.

I am using https://getbootstrap.com for the grid system.

I built it for my personal page: https://danilop.net

1. Put static assets in the `static` folder.

2. Put HTML templates with `<!-- processLinks {JSON file} {thumbnail width} {title width} [max links] -->` where you want to embed links in the `src` folder. The thumbnail and title width are using the https://getbootstrap.com grid system and should add to 12. You can optionally add a maimum number of links to process from the source list.

3. The JSON file should be in the `data` folder and contain a single JSON array of links.

4. Run `npm run build` to create the `public` folder.

5. Using the Open Graph protocol, this is getting all the info (title, thumbnail) from the link source, such as Speaker Deck or YouTube.
