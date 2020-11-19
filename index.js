const axios = require('axios');
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

const secret = require('./secret');

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

const queryMyAnimeList = async (username) => {
  let result = [];
  let uri = 'https://api.myanimelist.net/v2/users/' + username + '/animelist?fields=media_type,list_status&limit=1000';
  
  while (true) {
    const response = await axios.get(uri, {
      headers: {'Authorization': 'Bearer ' + secret.malAccessToken},
    });

    result = result.concat(response.data.data);

    if (!response.data.paging.next) {
      return result;
    }

    uri = response.data.paging.next;
  }
}

const queryUserThemesBulk = async (usernames) => {
  const promises = [];

  for (let i = 0; i < usernames.length; i++) {
    promises.push(queryUserThemes(usernames[i]));
  }

  const result = await Promise.all(promises).then((values) => {
    const idToThemeMap = new Map();

    for (let i = 0; i < values.length; i++) {
      for (j = 0; j < values[i].length; j++) {
        const anime = values[i][j];
        const theme =  anime.themes[Math.floor(Math.random() * anime.themes.length)];

        const blob = {
          'animeTitle': anime.name,
          'songTitle': theme.themeName,
          'themeType': theme.themeType,
          'songLink': 'http' + theme.mirror.mirrorURL.slice(5),
        };

        idToThemeMap.set(anime.malID, blob);
      }
    }

    return idToThemeMap;
  });

  return result;
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
  const stripped = request.body.username.replace(/\s+/g, '');
  const usernames = stripped.split(',');

  if (usernames.length > 6) {
    throw new Error('No more than 6 lists please...');
  }

  queryUserThemesBulk(usernames).then((idToThemeMap) => {
    const malPromises = [];

    for (let i = 0; i < usernames.length; i++) {
      malPromises.push(queryMyAnimeList(usernames[i]));
    }

    Promise.all(malPromises).then((values) => {
      const filteredSet = new Set();

      for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < values[i].length; j++) {
          const animeNode = values[i][j];
    
          if (!idToThemeMap.has(animeNode.node.id)) {
            continue;
          }
    
          if (!request.body.media_types.includes(animeNode.node.media_type)) {
            continue;
          }
    
          if (!request.body.list_status.includes(animeNode.list_status.status)) {
            continue;
          }
    
          filteredSet.add(animeNode.node.id);
        }
      }
      
      const filteredIds = Array.from(filteredSet);
      const numSongs = Math.min(Number(request.body.num_songs), filteredIds.length);

      shuffleArray(filteredIds);

      const result = filteredIds.slice(0, numSongs).map(id => idToThemeMap.get(id));

      response.render('pages/list', { username: usernames.join(' + '), songData: result });
    }).catch(next);
  }).catch(next);
  
});

app.get('/', (_, response) => {
  response.render('pages/index');
});

 app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
