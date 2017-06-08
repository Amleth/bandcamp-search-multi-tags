const axios = require('axios');
const cheerio = require('cheerio');

const tags = process.argv.slice(2);

// HELPERS

const make_url = (tag, page) => page === undefined ? `https://bandcamp.com/tag/${tag}` : `https://bandcamp.com/tag/${tag}/${page}`;

const get_pages = async(tag, url) => {
  console.log('FETCHING:', url)
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  var pages = $('.pagenum').map((index, element) => $(element).attr('href')).get();
  pages.unshift('?page=1');
  return {
    pages,
    tag,
    url
  };
};

const get_albums_on_page = async(tag, url) => {
  console.log('FETCHING:', url);
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  return $('.item').map((index, element) => ({
    album: $(element).find('div.itemtext').text(),
    art: $(element).find('div.art').attr('onclick').match(/.*(https?:\/\/.*)\).*/)[1],
    artist: $(element).find('div.itemsubtext').text(),
    page: url,
    url: $(element).find('a').attr('href')
  })).get();
};

// MAIN BLOCK

(async() => {
  // FETCH TAGS PAGES

  const pages_promises = [];
  for (const tag of tags) {
    pages_promises.push(get_pages(tag, make_url(tag)));
  }
  const tag_first_pages = await Promise.all(pages_promises);

  // FETCH ALBUMS

  const albums_promises = [];
  for (const tfp of tag_first_pages) {
    for (const tp of tfp.pages) {
      const tag_page_url = tfp.url + (tp !== undefined ? tp : '') + '&sort_field=pop';
      albums_promises.push(get_albums_on_page(tfp.tag, tag_page_url));
    }
  }
  let albums = await Promise.all(albums_promises);
  albums = [].concat(...albums);
  console.log(`${albums.length} albums with at least one tag`);

  // AGGREAGATE

  const albums_registry = new Map();
  for (const album of albums) {
    if (!albums_registry.has(album.art)) {
      albums_registry.set(album.art, {
        count: 1,
        album
      });
    } else {
      const a = albums_registry.get(album.art);
      a.count++;
      albums_registry.set(album.art, a);
    }
  }
  let albums_with_all_tags = [];
  albums_registry.forEach((value, key, map) => {
    if (value.count === tags.length) {
      albums_with_all_tags.push(value);
    }
  });
  albums_with_all_tags = albums_with_all_tags.map(_ => _.album);
  console.log(`${albums_with_all_tags.length} albums with all tags: ${tags.join(' ')}`);
  console.log(albums_with_all_tags);
})();