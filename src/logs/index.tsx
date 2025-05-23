import React from "react";
import ReactDOM from "react-dom/client";
import Logs from "./logs";

const rootElement = document.getElementById("root") ?? document.body;
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Logs />
  </React.StrictMode>
);
