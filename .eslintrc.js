module.exports = {
    "extends" : "hubspot",
    "plugins": [],
    "rules": {
        "linebreak-style": [
            "error",
            "unix"
        ],
        "semi": [
            "error",
            "always"
        ],
        "indent": [
            "error",
            2,
            {
                "SwitchCase": 1
            }
        ],
        "key-spacing": [
            "error",
            {
                "beforeColon": true
            }
        ]

    }
};