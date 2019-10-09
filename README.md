# danilop-personal-page

![Sample personal page](https://danilop.s3.amazonaws.com/Images/danilop-personal-page.png)

A simple script to populate a web page with links, retrieving link info using the Open Graph protocol.

I built it for my personal page: https://danilop.net

1. Put static assets in the `static` folder.

2. Put HTML templates with `processLinks` where you want to embed links in the `src` folder.

3. Put links as a JSON array in the `data` folder.

4. Using the Open Graph protocol, this is getting info from the link source.

5. The output goes in a `public` folder.
