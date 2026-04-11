import axios from "axios";

export const httpClient = axios.create({
  timeout: 15_000,
  maxRedirects: 5,
  headers: {
    "User-Agent": "OPTCG-Japan-Tracker/0.1"
  }
});
