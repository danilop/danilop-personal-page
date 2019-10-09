# danilop-personal-page

A simple script to populate a web page with links, retrieving link info using the Open Graph protocol.

I built it for my personal page: https://danilop.net

Put static assets in the `static` folder.

Put HTML templates with `processLinks` where you want to embed links in the `src` folder.

Put links as a JSON array in the `data` folder.

Using the Open Graph protocol, I am currently getting info from the AWS Blog, Speaker Deck, and YouTube.

The output goes in a `public` folder.
