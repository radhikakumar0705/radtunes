const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const fetch = require("node-fetch");

const app = express();
const PORT = 8081;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- DB Setup ---
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "Chinky%12",
  database: "radtunes",
};

const pool = mysql.createPool(dbConfig);

// --- Helper to wrap routes with error handling ---
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- AUTH ---
app.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query(
    "SELECT * FROM User WHERE username = ? AND password_hash = ?",
    [username, password]
  );
  res.json(rows.length ? { success: true, user: rows[0] } : { success: false, message: "Invalid credentials" });
}));

app.post("/signup", asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    await pool.query(
      "INSERT INTO User (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, password]  // 👈 Ideally hash the password too
    );

    res.status(201).json({ success: true, message: "User created" });
  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: "Username or email already exists" });
    }
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}));


// --- MUSIC HIGHLIGHTS ---
app.get("/home/music-highlights/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const [result] = await pool.query(`
    SELECT 
      s.title AS song_title,
      a.name AS artist_name,
      mh.total_listening_time
    FROM Music_Highlights mh
    LEFT JOIN Song s ON mh.most_played_song_id = s.song_id
    LEFT JOIN Artist a ON mh.most_played_artist_id = a.artist_id
    WHERE mh.user_id = ?
  `, [userId]);

  if (!result.length) {
    return res.json({ song_title: null, artist_name: null, total_listening_time: 0 });
  }

  const { song_title, artist_name, total_listening_time } = result[0];
  res.json({ song_title, artist_name, total_listening_time });
}));

app.post("/home/update-highlights/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const [[topSong]] = await pool.query(`
    SELECT s.song_id, COUNT(*) AS play_count
    FROM Listening_History lh
    JOIN Song s ON lh.song_id = s.song_id
    WHERE lh.user_id = ?
    GROUP BY lh.song_id
    ORDER BY play_count DESC
    LIMIT 1
  `, [userId]);

  const [[topArtist]] = await pool.query(`
    SELECT a.artist_id, COUNT(*) AS play_count
    FROM Listening_History lh
    JOIN Song s ON lh.song_id = s.song_id
    JOIN Artist a ON s.artist_id = a.artist_id
    WHERE lh.user_id = ?
    GROUP BY a.artist_id
    ORDER BY play_count DESC
    LIMIT 1
  `, [userId]);

  const [[totalTime]] = await pool.query(`
    SELECT SUM(s.duration) AS total_time
    FROM Listening_History lh
    JOIN Song s ON lh.song_id = s.song_id
    WHERE lh.user_id = ?
  `, [userId]);

  await pool.query(`
    INSERT INTO Music_Highlights (user_id, most_played_song_id, most_played_artist_id, total_listening_time)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      most_played_song_id = VALUES(most_played_song_id),
      most_played_artist_id = VALUES(most_played_artist_id),
      total_listening_time = VALUES(total_listening_time)
  `, [
    userId,
    topSong?.song_id || null,
    topArtist?.artist_id || null,
    totalTime?.total_time || 0
  ]);

  res.sendStatus(200);
}));

// --- STATS ROUTES ---
const statsRoutes = [
  {
    path: "/home/top-songs/:userId",
    query: `
      SELECT s.title, a.name, COUNT(*) AS play_count
      FROM Listening_History lh
      JOIN Song s ON lh.song_id = s.song_id
      JOIN Artist a ON s.artist_id = a.artist_id
      WHERE lh.user_id = ?
      GROUP BY lh.song_id
      ORDER BY play_count DESC
      LIMIT 5
    `
  },
  {
    path: "/home/top-artists/:userId",
    query: `
      SELECT a.name, COUNT(*) AS play_count
      FROM Listening_History lh
      JOIN Song s ON lh.song_id = s.song_id
      JOIN Artist a ON s.artist_id = a.artist_id
      WHERE lh.user_id = ?
      GROUP BY a.artist_id
      ORDER BY play_count DESC
      LIMIT 5
    `
  },
  {
    path: "/home/recently-played/:userId",
    query: `
      SELECT s.title, a.name, lh.listened_at
      FROM Listening_History lh
      JOIN Song s ON lh.song_id = s.song_id
      JOIN Artist a ON s.artist_id = a.artist_id
      WHERE lh.user_id = ?
      ORDER BY lh.listened_at DESC
      LIMIT 5
    `
  }
];

statsRoutes.forEach(({ path, query }) => {
  app.get(path, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const [rows] = await pool.query(query, [userId]);
    res.json(rows);
  }));
});

// --- PLAYLIST ROUTES ---
app.get("/home/playlists/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const [playlists] = await pool.query("SELECT * FROM Playlist WHERE user_id = ?", [userId]);

  for (const pl of playlists) {
    const [songs] = await pool.query(`
      SELECT s.song_id, s.title, a.name
      FROM Playlist_Songs ps
      JOIN Song s ON ps.song_id = s.song_id
      JOIN Artist a ON s.artist_id = a.artist_id
      WHERE ps.playlist_id = ?
    `, [pl.playlist_id]);

    pl.songs = songs;
  }

  res.json(playlists);
}));

app.post("/home/create-playlist", asyncHandler(async (req, res) => {
  const { userId, playlistName } = req.body;
  await pool.query(
    "INSERT INTO Playlist (user_id, playlist_name) VALUES (?, ?)",
    [userId, playlistName]
  );
  res.sendStatus(201);
}));

app.delete("/home/delete-playlist/:playlistId", asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  await pool.query("DELETE FROM Playlist_Songs WHERE playlist_id = ?", [playlistId]);
  await pool.query("DELETE FROM Playlist WHERE playlist_id = ?", [playlistId]);
  res.sendStatus(200);
}));

app.post("/home/add-song", asyncHandler(async (req, res) => {
  const { playlistId, songId } = req.body;
  await pool.query(
    "INSERT IGNORE INTO Playlist_Songs (playlist_id, song_id) VALUES (?, ?)",
    [playlistId, songId]
  );
  res.sendStatus(201);
}));

app.delete("/home/remove-song", asyncHandler(async (req, res) => {
  const { playlistId, songId } = req.query;
  await pool.query(
    "DELETE FROM Playlist_Songs WHERE playlist_id = ? AND song_id = ?",
    [playlistId, songId]
  );
  res.sendStatus(200);
}));

app.post("/home/log-playlist-listen", asyncHandler(async (req, res) => {
  const { userId, playlistId } = req.body;

  const [songs] = await pool.query(
    "SELECT song_id FROM Playlist_Songs WHERE playlist_id = ?",
    [playlistId]
  );

  const now = new Date();

  for (const { song_id } of songs) {
    await pool.query(
      "INSERT INTO Listening_History (user_id, song_id, listened_at) VALUES (?, ?, ?)",
      [userId, song_id, now]
    );
  }

  await fetch(`http://localhost:8081/home/update-highlights/${userId}`);
  res.sendStatus(200);
}));

// --- SONGS DROPDOWN ---
app.get("/songs/all", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.song_id, s.title, a.name
    FROM Song s
    JOIN Artist a ON s.artist_id = a.artist_id
  `);
  res.json(rows);
}));

// --- Start Server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
