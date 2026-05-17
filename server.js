const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const API_KEY = process.env.API_KEY;

const cache = new Map();
const CACHE_TIME = 60 * 1000;

function getCacheKey(followerId, targetId) {
  return `${followerId}:${targetId}`;
}

async function isFollowing(followerId, targetId) {
  const key = getCacheKey(followerId, targetId);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.time < CACHE_TIME) {
    return {
      ok: true,
      following: cached.following,
      cached: true
    };
  }

  let cursor = "";
  let pagesChecked = 0;
  const maxPages = 20;

  while (pagesChecked < maxPages) {
    const url =
      `https://friends.roblox.com/v1/users/${followerId}/followings?limit=100&sortOrder=Desc` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "FollowForAFollowGame/1.0"
      }
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Roblox API error ${response.status}`
      };
    }

    const data = await response.json();

    if (Array.isArray(data.data)) {
      const found = data.data.some(user => String(user.id) === String(targetId));

      if (found) {
        cache.set(key, {
          time: Date.now(),
          following: true
        });

        return {
          ok: true,
          following: true,
          cached: false
        };
      }
    }

    if (!data.nextPageCursor) {
      break;
    }

    cursor = data.nextPageCursor;
    pagesChecked++;
  }

  cache.set(key, {
    time: Date.now(),
    following: false
  });

  return {
    ok: true,
    following: false,
    cached: false
  };
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Follow For A Follow API is running"
  });
});

app.get("/check-follow", async (req, res) => {
  try {
    const { followerId, targetId, key } = req.query;

    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "API_KEY is missing on server"
      });
    }

    if (key !== API_KEY) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    if (!followerId || !targetId) {
      return res.status(400).json({
        ok: false,
        error: "Missing followerId or targetId"
      });
    }

    if (!/^\d+$/.test(String(followerId)) || !/^\d+$/.test(String(targetId))) {
      return res.status(400).json({
        ok: false,
        error: "IDs must be numbers"
      });
    }

    const result = await isFollowing(followerId, targetId);

    if (!result.ok) {
      return res.status(500).json(result);
    }

    res.json({
      ok: true,
      followerId: Number(followerId),
      targetId: Number(targetId),
      following: result.following,
      cached: result.cached
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Server error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Follow API running on port ${PORT}`);
});
