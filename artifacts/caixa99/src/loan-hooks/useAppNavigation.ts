import { useState } from "react";

export type AppTab = "inicio" | "calendario" | "historico" | "dashboard";

export const useAppNavigation = () => {
  const [activeTab, setActiveTab] = useState<AppTab>("inicio");
  const [isEditing, setIsEditing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearHistoryClick = () => setShowClearHistoryConfirm(true);
  const handleDeleteGoal = () => setShowDeleteConfirm(true);

  return {
    activeTab,
    setActiveTab,
    isEditing,
    setIsEditing,
    isDropdownOpen,
    setIsDropdownOpen,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showClearHistoryConfirm,
    setShowClearHistoryConfirm,
    toastMessage,
    showToast,
    handleClearHistoryClick,
    handleDeleteGoal,
  };
};
