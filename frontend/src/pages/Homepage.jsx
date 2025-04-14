import React, { useEffect, useState } from "react";
import axios from "axios";
import "./HomePage.css";

axios.defaults.baseURL = "http://localhost:8081";

const HomePage = () => {
  const userWrapper = JSON.parse(localStorage.getItem("user"));
  const user = userWrapper?.user;
  const userId = user?.user_id;

  const [topSongs, setTopSongs] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [highlights, setHighlights] = useState({});
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const fetchAll = async () => {
    try {
      console.log("📡 Fetching all homepage data...");
      const [
        songsRes,
        artistsRes,
        recentRes,
        playlistsRes,
        songsList,
        highlightsRes,
      ] = await Promise.all([
        axios.get(`/home/top-songs/${userId}`),
        axios.get(`/home/top-artists/${userId}`),
        axios.get(`/home/recently-played/${userId}`),
        axios.get(`/home/playlists/${userId}`),
        axios.get("/songs/all"),
        axios.get(`/home/music-highlights/${userId}`),
      ]);

      setTopSongs(Array.isArray(songsRes.data) ? songsRes.data : []);
      setTopArtists(Array.isArray(artistsRes.data) ? artistsRes.data : []);
      setRecentlyPlayed(Array.isArray(recentRes.data) ? recentRes.data : []);
      setPlaylists(Array.isArray(playlistsRes.data) ? playlistsRes.data : []);
      setAllSongs(Array.isArray(songsList.data) ? songsList.data : []);
      setHighlights(highlightsRes.data || {});
    } catch (err) {
      console.error("❌ Error fetching homepage data:", err);
    }
  };

  useEffect(() => {
    if (userId) {
      axios
        .post(`/home/update-highlights/${userId}`)
        .then(fetchAll)
        .catch((err) => {
          console.error("⚠️ Error updating highlights:", err);
          fetchAll();
        });
    }
  }, [userId]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      await axios.post("/home/create-playlist", {
        userId,
        playlistName: newPlaylistName,
      });
      setNewPlaylistName("");
      fetchAll();
    } catch (err) {
      console.error("❌ Error creating playlist:", err);
    }
  };

  const deletePlaylist = async (id) => {
    try {
      await axios.delete(`/home/delete-playlist/${id}`);
      fetchAll();
    } catch (err) {
      console.error("❌ Error deleting playlist:", err);
    }
  };

  const addSong = async (playlistId, songId) => {
    try {
      await axios.post("/home/add-song", { playlistId, songId });
      fetchAll();
    } catch (err) {
      console.error("❌ Error adding song to playlist:", err);
    }
  };

  const removeSong = async (playlistId, songId) => {
    try {
      await axios.delete("/home/remove-song", {
        params: { playlistId, songId },
      });
      fetchAll();
    } catch (err) {
      console.error("❌ Error removing song from playlist:", err);
    }
  };

  const playPlaylist = async (playlistId) => {
    try {
      await axios.post("/home/log-playlist-listen", { userId, playlistId });
      fetchAll();
    } catch (err) {
      console.error("❌ Error logging playlist play:", err);
    }
  };

  return (
    <div className="homepage">
      <nav className="navbar">
        {/* Updated logo: you can place your logo image in public folder or assets */}
        <img src="logo3.png" alt="RadTunes Logo" className="logo-img" />
        <div className="nav-links">
          <a href="#highlights">🎧 Highlights</a>
          <a href="#songs">🎵 Top Songs</a>
          <a href="#artists">🎤 Top Artists</a>
          <a href="#recent">🕑 Recently Played</a>
          <a href="#playlists">📁 Playlists</a>
        </div>
        <div className="user-dropdown">
          <span>{user?.username} ⏷</span>
          <div className="dropdown-content">
            <button onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <section className="highlight-section" id="highlights">
        <h2>Music Highlights</h2>
        <div className="highlight-cards">
          <div className="highlight-card">
            <strong>Most Played Song</strong>
            <p>{highlights.song_title || "N/A"}</p>
          </div>
          <div className="highlight-card">
            <strong>Most Played Artist</strong>
            <p>{highlights.artist_name || "N/A"}</p>
          </div>
          <div className="highlight-card">
            <strong>Total Listening Time</strong>
            <p>{highlights.total_listening_time || 0} secs</p>
          </div>
        </div>
      </section>

      <section id="songs">
        <h2>Top Songs</h2>
        <div className="card-grid">
          {topSongs.length === 0 ? (
            <p>🚨 No songs to show</p>
          ) : (
            topSongs.map((s, i) => (
              <div key={i} className="card hover-grow">
                <p><strong>{s.title}</strong></p>
                <p>{s.name}</p>
                <p>Plays: {s.play_count}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="artists">
        <h2>Top Artists</h2>
        <div className="card-grid">
          {topArtists.map((a, i) => (
            <div key={i} className="card hover-grow">
              <p><strong>{a.name}</strong></p>
              <p>Plays: {a.play_count}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="recent">
        <h2>Recently Played</h2>
        <div className="recent-scroll">
          {recentlyPlayed.map((s, i) => (
            <div key={i} className="card">
              <p><strong>{s.title}</strong></p>
              <p>{s.name}</p>
              <p>{new Date(s.listened_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="playlists">
        <h2>Playlists</h2>
        <div className="playlist-create">
          <input
            type="text"
            placeholder="New playlist name"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
          />
          <button onClick={createPlaylist}>Create</button>
        </div>

        <div className="playlist-section">
          {playlists.map((pl) => (
            <div key={pl.playlist_id} className="playlist-card">
              <div className="playlist-header">
                <h3>{pl.playlist_name}</h3>
                <div>
                  <button onClick={() => playPlaylist(pl.playlist_id)}>▶️</button>
                  <button onClick={() => deletePlaylist(pl.playlist_id)}>❌</button>
                </div>
              </div>
              <div className="playlist-songs">
                {pl.songs.map((song) => (
                  <div key={song.song_id} className="playlist-song">
                    <span>{song.title} - {song.name}</span>
                    <button onClick={() => removeSong(pl.playlist_id, song.song_id)}>Remove</button>
                  </div>
                ))}
                <select
                  onChange={(e) => addSong(pl.playlist_id, parseInt(e.target.value))}
                  defaultValue=""
                >
                  <option value="" disabled>Add Song</option>
                  {allSongs
                    .filter((s) => !pl.songs.find((ps) => ps.song_id === s.song_id))
                    .map((s) => (
                      <option key={s.song_id} value={s.song_id}>
                        {s.title} - {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
