import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div style={{ maxWidth: 900, margin: "20px auto", padding: "0 16px" }}>
      <App />
    </div>
  </React.StrictMode>
);
