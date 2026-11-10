import { API_URL, deviceId } from './config'
import { createApi } from './api'
export const api = createApi({ base: API_URL, device: deviceId() })
