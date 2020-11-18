const axios = require('axios');
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

//=============================================================================
// ** Util
//=============================================================================

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}

//=============================================================================
// ** External Access
//=============================================================================

const MAL_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6Ijk2NDkyZmNmNDg5NDNkNzI4OWJlZTc0N2Q0MjI1YmFlY2FjMWZiOGVjNzA3NWUyM2I4ODVkMzhlZmFlODJkMzA0MDJjZWQzNzI2OGY5ZGQ2In0.eyJhdWQiOiI4ODBhMzNiMzdlZTkzNmQ1ZWRhZDk5ZTZlZmIzN2Y4MCIsImp0aSI6Ijk2NDkyZmNmNDg5NDNkNzI4OWJlZTc0N2Q0MjI1YmFlY2FjMWZiOGVjNzA3NWUyM2I4ODVkMzhlZmFlODJkMzA0MDJjZWQzNzI2OGY5ZGQ2IiwiaWF0IjoxNjA1NjQ1MjE5LCJuYmYiOjE2MDU2NDUyMTksImV4cCI6MTYwODIzNzIxOSwic3ViIjoiMzUxNzQ4MSIsInNjb3BlcyI6W119.rr4o3Yw86lsLX0ATZx5bv4Cy4MtEdHZ_W2I6OGhleU5-jpG1lz1SGTueA9WLq9i0YVYrMQICX_3fjoUK4xHmnVTYP5bthfeLrANHBAQ3rqqbDKMjGk-TkSnqD2SILch7a12IP4cG33igrYgbLA4aK6gXsZNifdO_DGfZobsX7lRFmzmEswLZfh_1S-k0qikCM9q2Dihf-TGifWntqceFv7xlzK8_pWk2rayxu3ZFdKxJdGj9WvNkMy64fzZf6vQmg1bKfHNSKz9lPlvdZIjuybFWRTN1pu_m1IM-0X5AuV4iMRdwuMeG1cVxtsSS2JKwY_T5t6y0KT_sXkqUaGMCAQ";

const queryMyAnimeList = async (username) => {
  let result = [];
  let uri = 'https://api.myanimelist.net/v2/users/' + username + '/animelist?fields=media_type,list_status&limit=1000';
  
  while (true) {
    const response = await axios.get(uri, {
      headers: {'Authorization': 'Bearer ' + MAL_ACCESS_TOKEN},
    });

    result = result.concat(response.data.data);

    if (!response.data.paging.next) {
      return result;
    }

    uri = response.data.paging.next;
  }
}

const queryUserThemes = async (username) => {
  const response = await axios.get('https://themes.moe/api/mal/' + username);

  return response.data;
}

//============================================================================
// ** Main
//============================================================================

const app = express()

app
  .use(express.urlencoded({ extended: false }))
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs');

app.post('/playlist', (request, response, next) => {
  console.log(request.body);

  const username = request.body.username;

  const malPromise = queryMyAnimeList(username);
  const themesPromise = queryUserThemes(username);

  Promise.all([malPromise, themesPromise]).then((values) => {
    const malData = values[0];
    const themesData = values[1];

    const filteredIds = new Set();

    for (let i = 0; i < malData.length; i++) {
      const animeNode = malData[i];

      if (!request.body.media_types.includes(animeNode.node.media_type)) {
        continue;
      }

      if (!request.body.list_status.includes(animeNode.list_status.status)) {
        continue;
      }

      filteredIds.add(animeNode.node.id);
    }

    const filteredAnime = themesData.filter(node => filteredIds.has(node.malID));
    const numSongs = Math.min(Number(request.body.num_songs), filteredAnime.length);

    shuffleArray(filteredAnime);

    const processedAnime = filteredAnime.slice(0, numSongs);

    const result = processedAnime.map(anime => {
      const theme =  anime.themes[Math.floor(Math.random() * anime.themes.length)];

      return {
        'animeTitle': anime.name,
        'songTitle': theme.themeName,
        'themeType': theme.themeType,
      }
    });

    response.render('pages/list', { username: username, songData: result });
  }).catch(next);
});

app.get('/', (_, response) => {
  response.render('pages/index');
});

 app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
