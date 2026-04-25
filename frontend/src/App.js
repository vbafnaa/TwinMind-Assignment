import Landing from "./pages/Landing";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TwinMindLive from "./pages/TwinMindLive";
import TwinMindSettings from "./pages/TwinMindSettings";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/Login" element={<Login />} />
          <Route path="/Signup" element={<Signup />} />
          <Route path="/twinmind" element={<TwinMindLive />} />
          <Route path="/twinmind/settings" element={<TwinMindSettings />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
