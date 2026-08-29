(() => {
  try {
    const saved = localStorage.getItem("bikers-theme");
    const theme = saved === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  } catch {
    const root = document.documentElement;
    root.dataset.theme = "dark";
    root.classList.add("dark");
    root.classList.remove("light");
  }
})();
