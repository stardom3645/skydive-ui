import * as React from "react";
import { useState } from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";

/// 현재 언어를 localStorage에서 불러오거나 기본 'ko'
const getSavedLanguage = (): "en" | "ko" => {
  const saved = localStorage.getItem("language");
  return saved === "en" || saved === "ko" ? saved : "ko";
};

export default function LanguageToggle() {
  const [language, setLanguage] = useState<"en" | "ko">(getSavedLanguage());

  const handleLanguageChange = (
    event: React.MouseEvent<HTMLElement>,
    newLanguage: "en" | "ko" | null
  ) => {
    if (newLanguage) {
      setLanguage(newLanguage);
      localStorage.setItem("language", newLanguage);
      window.location.reload();
    }
  };

  return (
    <ToggleButtonGroup
      value={language}
      exclusive
      onChange={handleLanguageChange}
      aria-label="Language selection"
    >
      <ToggleButton value="ko" aria-label="Korean">
        한국어
      </ToggleButton>
      <ToggleButton value="en" aria-label="English">
        English
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
