// 自动生成：七巧板华容道多关卡数据（均经 BFS 验证可解）
// 小程序端走 module.exports；网页端挂到 window.LEVELS（同一份数据，双端共用）
// 整体包在 IIFE 中：避免顶层 const 泄漏到全局词法作用域，与网页端内联脚本的同名变量冲突。
;(function () {
const LEVELS = [
  {
    "id": "level-1",
    "theme": "stone",
    "name": "第1关 · 蓝块出逃",
    "goal": [
      1,
      0
    ],
    "optimal": 13,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": false
      },
      {
        "id": "square",
        "name": "蓝·正方形(目标)",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          1,
          2
        ],
        "goal": true
      },
      {
        "id": "tri_medium",
        "name": "红·中三角",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          1,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          2,
          1
        ],
        "goal": false
      },
      {
        "id": "para",
        "name": "黄·平行四边形",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          0
        ],
        "goal": false
      }
    ]
  },
  {
    "id": "level-2",
    "theme": "jelly",
    "name": "第2关 · 蓝块居中逃",
    "goal": [
      1,
      1
    ],
    "optimal": 13,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          2
        ],
        "goal": false
      },
      {
        "id": "square",
        "name": "蓝·正方形(目标)",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": true
      },
      {
        "id": "tri_medium",
        "name": "红·中三角",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          1,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          2,
          2
        ],
        "goal": false
      },
      {
        "id": "para",
        "name": "黄·平行四边形",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          0
        ],
        "goal": false
      }
    ]
  },
  {
    "id": "level-3",
    "theme": "glass",
    "name": "第3关 · 红三角出逃",
    "goal": [
      1,
      1
    ],
    "optimal": 13,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "square",
        "name": "蓝·正方形",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          2,
          2
        ],
        "goal": false
      },
      {
        "id": "tri_medium",
        "name": "红·中三角(目标)",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": true
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "para",
        "name": "黄·平行四边形",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          1
        ],
        "goal": false
      }
    ]
  },
  {
    "id": "level-4",
    "theme": "animal",
    "name": "第4关 · 黄块侧逃",
    "goal": [
      0,
      1
    ],
    "optimal": 10,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "square",
        "name": "蓝·正方形",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          1,
          0
        ],
        "goal": false
      },
      {
        "id": "tri_medium",
        "name": "红·中三角",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": false
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "para",
        "name": "黄·平行四边形(目标)",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          1
        ],
        "goal": true
      }
    ]
  },
  {
    "id": "level-5",
    "theme": "fire",
    "name": "第5关 · 绿块大逃",
    "goal": [
      0,
      1
    ],
    "optimal": 13,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角(目标)",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": true
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          2
        ],
        "goal": false
      },
      {
        "id": "square",
        "name": "蓝·正方形",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": false
      },
      {
        "id": "tri_medium",
        "name": "红·中三角",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          1,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          2
        ],
        "goal": false
      },
      {
        "id": "para",
        "name": "黄·平行四边形",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          0
        ],
        "goal": false
      }
    ]
  },
  {
    "id": "level-6",
    "theme": "crystal",
    "name": "第6关 · 小紫角逃",
    "goal": [
      2,
      2
    ],
    "optimal": 13,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A(目标)",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": true
      },
      {
        "id": "square",
        "name": "蓝·正方形",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          2,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_medium",
        "name": "红·中三角",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          1,
          2
        ],
        "goal": false
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          2,
          2
        ],
        "goal": false
      },
      {
        "id": "para",
        "name": "黄·平行四边形",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": false
      }
    ]
  },
  {
    "id": "level-7",
    "theme": "wood",
    "name": "第7关 · 粉块角逃",
    "goal": [
      2,
      0
    ],
    "optimal": 13,
    "pieces": [
      {
        "id": "tri_large",
        "name": "绿·大三角",
        "color": "#6F9144",
        "poly": [
          [
            0,
            0
          ],
          [
            2,
            0
          ],
          [
            0,
            2
          ]
        ],
        "offset": [
          0,
          0
        ],
        "goal": false
      },
      {
        "id": "tri_small_a",
        "name": "紫·小三角A",
        "color": "#35346C",
        "poly": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": false
      },
      {
        "id": "square",
        "name": "蓝·正方形",
        "color": "#327C99",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ],
        "offset": [
          2,
          2
        ],
        "goal": false
      },
      {
        "id": "tri_medium",
        "name": "红·中三角",
        "color": "#AE4433",
        "poly": [
          [
            0,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ],
        "offset": [
          0,
          1
        ],
        "goal": false
      },
      {
        "id": "tri_small_b",
        "name": "粉·小三角B(目标)",
        "color": "#CB7D89",
        "poly": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          0,
          2
        ],
        "goal": true
      },
      {
        "id": "para",
        "name": "黄·平行四边形",
        "color": "#CAAC33",
        "poly": [
          [
            0,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            1
          ]
        ],
        "offset": [
          1,
          0
        ],
        "goal": false
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) { module.exports = LEVELS; }
if (typeof window !== 'undefined') { window.LEVELS = LEVELS; }
})();
