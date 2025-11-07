import React, { createContext, useState } from "react";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [layoutId, setLayout] = useState(null); // store only layout id
  const [capturedImage, setCapturedImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [user, setUser] = useState(null);

  return (
    <AppContext.Provider
      value={{
        layoutId,
        setLayout,
        capturedImage,
        setCapturedImage,
        processedImage,
        setProcessedImage,
        selectedTemplate,
        setSelectedTemplate,
        user,
        setUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
