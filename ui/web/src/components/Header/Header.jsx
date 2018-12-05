// @flow
import React, {
  useState,
} from 'react';
import {
  Link,
} from 'react-router-dom';
import {
  Input,
  Button,
  Popover,
} from 'antd';

import * as S from './styled';
import logo from '../../assets/logo5.png';

type Props = {
  listedAssetPairs: Array<any>,
  currentAssetPair: any,
  onPairClick: Function,
  onNotificationsClick: Function,
  notifications: Array<any>,
}
const columns = [
  {
    title: 'Pair',
    key: 'pair',
    render: (text, record) => ([
      record.assetDataA.assetData.symbol,
      record.assetDataB.assetData.symbol,
    ].join('/')),
  },
  {
    title: 'Base token',
    dataIndex: 'assetDataA.assetData.name',
  },
  {
    title: 'Quote token',
    dataIndex: 'assetDataB.assetData.name',
  },
];

const Header = ({
  listedAssetPairs,
  currentAssetPair,
  onPairClick,
  onNotificationsClick,
  notifications,
}: Props) => {
  const [searchText, setSearchText] = useState('');
  const s = searchText.toLowerCase();
  const currentAssetPairSymbols = [
    currentAssetPair?.assetDataA?.assetData?.symbol || 'ZRX',
    currentAssetPair?.assetDataB?.assetData?.symbol || 'WETH',
  ];
  const currentAssetPairName = currentAssetPairSymbols.join('/');
  const currentLink = currentAssetPairSymbols.join('-');
  return (
    <S.Header>
      <S.InstexLogo src={logo} alt="logo" />
      <S.Trade>
        <S.HeaderIcon type="swap" />
        <Link to={currentLink}>
          Trade
        </Link>
      </S.Trade>
      <S.Account>
        <S.HeaderIcon type="home" />
        <Link to="/account">
          Account
        </Link>
      </S.Account>
      <Popover
        trigger="click"
        placement="bottom"
        content={(
          <S.PopoverContent>
            <S.SearchBar>
              <Input
                autoFocus
                value={searchText}
                onChange={ev => setSearchText(ev.target.value)}
                placeholder="Search token name, symbol or address"
              />
            </S.SearchBar>
            <S.TokensTable
              rowKey="id"
              size="middle"
              columns={columns}
              onRow={record => ({
                onClick: () => onPairClick(record),
              })}
              dataSource={listedAssetPairs.filter(p => (
                searchText.length
                  ? (
                    p.assetDataA.assetData.name.toLowerCase().includes(s)
                    || p.assetDataA.assetData.symbol.toLowerCase().includes(s)
                    || p.assetDataA.assetData.address.toLowerCase().includes(s)
                    || p.assetDataB.assetData.symbol.toLowerCase().includes(s)
                    || p.assetDataB.assetData.address.toLowerCase().includes(s)
                  )
                  : true
              ))}
            />
          </S.PopoverContent>
        )}
      >
        <Button type="primary">
          Tokens(
          {currentAssetPairName}
          )
          <S.HeaderIcon type="down" />
        </Button>
      </Popover>
      <S.NotificationContainer>
        <S.NotificationBadge count={
          notifications.reduce((acc, notification) => (
            notification.statusDescription === 'Pending' ? acc + 1 : acc
          ), 0)
        }
        >
          <S.NotificationIcon
            type="notification"
            style={{ fontSize: 24 }}
            onClick={onNotificationsClick}
          />
        </S.NotificationBadge>
      </S.NotificationContainer>
    </S.Header>
  );
};

export default Header;
