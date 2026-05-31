import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.tsx";
import Documents from "./pages/Documents.tsx";
import Conversations from "./pages/Conversations.tsx";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">CSBot Admin</h1>
            <p className="text-sm text-gray-500 mt-1">Customer Service Bot</p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/documents"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              Documents
            </NavLink>
            <NavLink
              to="/conversations"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              Conversations
            </NavLink>
          </nav>
          <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
            CSBot v0.1.0
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/conversations" element={<Conversations />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
