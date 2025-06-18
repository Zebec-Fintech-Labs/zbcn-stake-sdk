# ZBCN Stake Sdk

## Installation

```
yarn add @zebec-network/zebec-stake-sdk
```

```
npm install @zebec-network/zebec-stake-sdk
```

## Development

To build the package

```
yarn build
```

To run specific test filess

```
yarn test <test file path> -f "<regex for test name>"
// example:
// yarn test ./test/e2e/getLockupInfo.test.ts
```

## publish

Build package and bump package version to specific need and publish

```
npm publish --access public
```
