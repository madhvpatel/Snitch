import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthorityAnalystPage } from './pages/AuthorityAnalystPage';
import { AuthorityPage } from './pages/AuthorityPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthorityPage />} />
      <Route path="/authority" element={<AuthorityPage />} />
      <Route path="/authority-analyst" element={<AuthorityAnalystPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
