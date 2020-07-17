# qappx

快应用内应用级集中状态管理工具库。

受 vuex 的启发，在 vuex 的基础上做了快应用运行环境的相关适配，并对 vuex 的 api 做了一些修改，从而更好到运行在快应用平台上

## 使用

### 1. 安装

```
npm install -S @quickapp-eco/qappx
```

### 2. 使用

`qappx` 的运行依赖于[快应用框架前端插件](https://doc.quickapp.cn/framework/script.html)，所以需要快应用框架最小版本 `1060+`

`app.ux` 文件：

```
import { Store, installStore } from '@quickapp-eco/qappx'

// 实例化store
const store = new Store({
  state: {
    name: 'szm',
    detail: {
      height: '185cm',
      weight: '180g'
    }
  },
  getters: {
    height: state => state.detail.height,
    weight: state => state.detail.weight
  },
  mutations: {
    change(state, height) {
      state.detail.height = height
    }
  },
  actions: {
    change(context) {
      context.commit('change', '180cm')
    }
  }
})

// 插件引入
const pageNames = ['Demo', 'Detail'] // 挂载的页面名称
export default {
  plugins: [ installStore(store, { apply : pageNames }) ]
}
```

### 3. API 文档

具体 api 说明可参看 [API 文档](https://vuex.vuejs.org/zh/api/)，和 `vuex@3.1.2` 的主要 api 及相关功能特性基本一致。

#### 删除 api：

1. 构造器选项：

- `strict`
- `devtools`

2. 实例方法：

- `watch`
- `hotUpdate`

#### 新增 api：

- installStore(store, { apply, exclude })

##### 参数

| 名称               | 说明            | 类型                                           | 默认值                 |
| ------------------ | --------------- | ---------------------------------------------- | ---------------------- |
| store              | 全局 store 实例 | Store                                          | -                      |
| { apply, exclude } | 挂载页面参数    | { apply: String/Array, exclude: String/Array } | {apply:[], exclude:[]} |

**注意**：store 默认会挂载到快应用到所有页面上，如果考虑到性能问题，只需要挂载到特定的页面到话可以传入方法的第二个参数。
当使用第二个参数时，会优先使用 `apply`值，如果设置了 `apply` 时则丢弃 `exclude` 的值。

```
{
  apply: ['PageA','PageB'], // 只挂载在 PageA, PageB 页面上
  exclude: ['PageC', 'PageD'] // 排除 PageC, PageD 页面，挂载到其他页面上
}
```

## License

[MIT](./LICENSE)
