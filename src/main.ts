import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// index.html always has a #app div, so this is never null.
const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
