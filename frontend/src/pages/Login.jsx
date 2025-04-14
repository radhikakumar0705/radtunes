import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); // ← Add this line!
  
    try {
      const res = await fetch("http://localhost:8081/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
  
      if (!res.ok) {
        throw new Error("Login failed");
      }
  
      const data = await res.json();
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "/home";
    } catch (err) {
      alert("Login error. Try again.");
    }
  };
  
  
  

  return (
    <div className="login-container">
      <div className="left-side">
        <div className="login-box">
          <h1>RadTunes Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Log In</button>
          </form>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div className="signup-link">
            <p>Don't have an account?</p>
            <Link to="/signup">
              <button>Sign Up</button>
            </Link>
          </div>
        </div>
      </div>
      <div className="right-side">
        <img src="logo1.png" alt="RadTunes" />
      </div>
    </div>
  );
};

export default Login;
