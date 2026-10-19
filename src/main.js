import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import App from "./App.vue";
import i18n, { setI18nLanguage } from "./i18n";
import { useConfigStore } from "./stores/config";
import "./styles.css";
import "primeicons/primeicons.css";

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(i18n);

// 根据 store 中保存的语言设置初始化 i18n
const configStore = useConfigStore();
if (configStore.language) {
  setI18nLanguage(configStore.language);
}

app.mount("#app");
