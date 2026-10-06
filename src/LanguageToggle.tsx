import * as React from "react";
import { useState } from "react";
import { Segmented } from 'antd';

/// 현재 언어를 localStorage에서 불러오거나 기본 'ko'
const getSavedLanguage = (): "en" | "ko" => {
  const saved = localStorage.getItem("language");
  return saved === "en" || saved === "ko" ? saved : "ko";
};

export default function LanguageToggle() {
  const [language, setLanguage] = useState<"en" | "ko">(getSavedLanguage());

  const handleLanguageChange = (newLanguage: "en" | "ko") => {
    if (newLanguage) {
      setLanguage(newLanguage);
      localStorage.setItem("language", newLanguage);
      window.location.reload();
    }
  };

  return (
    <Segmented<"en" | "ko">
      block
      value={language}
      onChange={handleLanguageChange}
      aria-label="Language selection"
      options={[{ value: 'ko', label: '한국어' }, { value: 'en', label: 'English' }]}
    />
  );
}
