import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

// import LayoutSelection from "./pages/LayoutSelection";
import CameraPage from "./pages/CameraPage";
// import BgRemovedPage from "./pages/BgRemovedPage";
import FinalPage from "./pages/FinalPage";
// import PreviewPage from "./pages/PreviewPage";
import UserAndLayoutPage from "./pages/UserDetails";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserAndLayoutPage/>}/>
        {/* <Route path="/layouts" element={<LayoutSelection />} /> */}
        <Route path="/camera" element={<CameraPage />} />
        {/* <Route path="/preview" element={<PreviewPage />} /> */}
        {/* <Route path="/bg-remove" element={<BgRemovedPage />} /> */}
        <Route path="/final" element={<FinalPage />} />
      </Routes>
    </Router>
  );
}

export default App;
