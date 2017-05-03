module.exports = {
    entry: "./lib/odoorpc.ts",
    output: {
        path: __dirname + "/lib",
        filename: "odoorpc.js"
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        loaders: [
            { test: /\.ts$/, exclude: /node_modules/, loader: 'awesome-typescript-loader'},
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"}
        ]
    }
};