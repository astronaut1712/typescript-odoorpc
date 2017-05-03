module.exports = {
    entry: "./example/index.ts",
    output: {
        path: __dirname + "/example",
        filename: "index.js"
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        loaders: [
            { test: /\.ts$/, loader: 'awesome-typescript-loader'},
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"}
        ]
    }
};