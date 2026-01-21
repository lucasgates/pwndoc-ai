import Vue from 'vue'

export default {
  getFile: function(fileId) {
    return Vue.prototype.$axios.get(`files/${fileId}`)
  },

  createFile: function(file) {
    return Vue.prototype.$axios.post('files', file)
  },

  deleteFile: function(fileId) {
    return Vue.prototype.$axios.delete(`files/${fileId}`)
  },

  downloadFile: function(fileId) {
    return Vue.prototype.$axios.get(`files/download/${fileId}`, {
      responseType: 'blob'
    })
  }
}
