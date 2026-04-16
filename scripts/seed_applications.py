"""黑客松前：補充 Demo 案件資料 + 修正未來日期"""
import json

with open('data/applications.json', encoding='utf-8') as f:
    existing = json.load(f)

# 修正未來日期
for c in existing:
    if c['id'] == 'TCB-20260418-0001':
        c['id'] = 'TCB-20260417-0001'
        c['appliedAt'] = '2026-04-17T09:23:41.000Z'
    if c['id'] == 'TCB-20260420-0001':
        c['id'] = 'TCB-20260416-0001'
        c['appliedAt'] = '2026-04-16T14:05:18.000Z'

new_cases = [
    # Apr 4
    {
        'id': 'TCB-20260404-0001', 'lineUserId': '', 'applicantName': '倪福德',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 38, 'occupation': '軍人', 'jobTitle': '現役軍人', 'income': 72000, 'purpose': '資金周轉', 'termYears': 5, 'amount': 1000000},
        'propertyInfo': None, 'recommendedProductId': 'army-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'approved', 'appliedAt': '2026-04-04T10:12:33.000Z',
    },
    {
        'id': 'TCB-20260404-0002', 'lineUserId': '', 'applicantName': '彭政閔',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 41, 'occupation': '上班族', 'jobTitle': '工程師', 'income': 85000, 'purpose': '首購自住', 'termYears': 30, 'amount': 8000000},
        'propertyInfo': {'propertyAge': 8, 'areaPing': 32.5, 'hasParking': True, 'layout': '3房2廳1衛', 'floor': 5, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'general-mortgage',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'pending', 'appliedAt': '2026-04-04T15:44:21.000Z',
    },
    # Apr 6
    {
        'id': 'TCB-20260406-0001', 'lineUserId': '', 'applicantName': '羅嘉仁',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 32, 'occupation': '公務員', 'jobTitle': '行政員', 'income': 60000, 'purpose': '裝潢修繕', 'termYears': 3, 'amount': 500000},
        'propertyInfo': None, 'recommendedProductId': 'civil-servant-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'approved', 'appliedAt': '2026-04-06T09:30:00.000Z',
    },
    {
        'id': 'TCB-20260406-0002', 'lineUserId': '', 'applicantName': '曾義宗',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 45, 'occupation': '自營商', 'jobTitle': '餐廳老闆', 'income': 150000, 'purpose': '投資理財', 'termYears': 20, 'amount': 15000000},
        'propertyInfo': {'propertyAge': 15, 'areaPing': 55.0, 'hasParking': True, 'layout': '4房2廳3衛', 'floor': 12, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'general-mortgage',
        'mydataReady': False, 'landRegistryReady': True,
        'status': 'pending', 'appliedAt': '2026-04-06T16:22:47.000Z',
    },
    # Apr 7
    {
        'id': 'TCB-20260407-0001', 'lineUserId': '', 'applicantName': '黃忠義',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 44, 'occupation': '教師', 'jobTitle': '國中老師', 'income': 72000, 'purpose': '自住', 'termYears': 30, 'amount': 7000000},
        'propertyInfo': {'propertyAge': 3, 'areaPing': 28.0, 'hasParking': False, 'layout': '2房2廳1衛', 'floor': 8, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'young-safe-home',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'approved', 'appliedAt': '2026-04-07T11:05:12.000Z',
    },
    {
        'id': 'TCB-20260407-0002', 'lineUserId': '', 'applicantName': '林英傑',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 29, 'occupation': '上班族', 'jobTitle': '業務員', 'income': 52000, 'purpose': '資金周轉', 'termYears': 5, 'amount': 800000},
        'propertyInfo': None, 'recommendedProductId': 'general-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'pending', 'appliedAt': '2026-04-07T14:18:55.000Z',
    },
    # Apr 8
    {
        'id': 'TCB-20260408-0001', 'lineUserId': '', 'applicantName': '陳金鋒',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 52, 'occupation': '自營商', 'jobTitle': '貿易公司負責人', 'income': 180000, 'purpose': '首購自住', 'termYears': 20, 'amount': 20000000},
        'propertyInfo': {'propertyAge': 25, 'areaPing': 68.5, 'hasParking': True, 'layout': '4房2廳2衛', 'floor': 3, 'buildingType': '透天厝'},
        'recommendedProductId': 'general-mortgage',
        'mydataReady': False, 'landRegistryReady': False,
        'status': 'rejected', 'appliedAt': '2026-04-08T09:45:30.000Z',
    },
    # Apr 10
    {
        'id': 'TCB-20260410-0001', 'lineUserId': '', 'applicantName': '郭李建夫',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 36, 'occupation': '公務員', 'jobTitle': '警察', 'income': 65000, 'purpose': '資金周轉', 'termYears': 3, 'amount': 300000},
        'propertyInfo': None, 'recommendedProductId': 'civil-servant-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'approved', 'appliedAt': '2026-04-10T10:30:00.000Z',
    },
    {
        'id': 'TCB-20260410-0002', 'lineUserId': '', 'applicantName': '宋文華',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 37, 'occupation': '上班族', 'jobTitle': '護理師', 'income': 90000, 'purpose': '首購自住', 'termYears': 30, 'amount': 12000000},
        'propertyInfo': {'propertyAge': 5, 'areaPing': 35.0, 'hasParking': True, 'layout': '3房2廳2衛', 'floor': 10, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'young-safe-home',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'pending', 'appliedAt': '2026-04-10T15:22:19.000Z',
    },
    # Apr 11
    {
        'id': 'TCB-20260411-0001', 'lineUserId': '', 'applicantName': '林宸緯',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 26, 'occupation': '上班族', 'jobTitle': '工程師', 'income': 58000, 'purpose': '資金周轉', 'termYears': 5, 'amount': 600000},
        'propertyInfo': None, 'recommendedProductId': 'general-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'pending', 'appliedAt': '2026-04-11T08:50:00.000Z',
    },
    {
        'id': 'TCB-20260411-0002', 'lineUserId': '', 'applicantName': '陳冠任',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 39, 'occupation': '軍人', 'jobTitle': '現役軍官', 'income': 80000, 'purpose': '自住', 'termYears': 30, 'amount': 7500000},
        'propertyInfo': {'propertyAge': 2, 'areaPing': 30.0, 'hasParking': True, 'layout': '3房2廳1衛', 'floor': 6, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'army-mortgage',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'approved', 'appliedAt': '2026-04-11T13:40:22.000Z',
    },
    # Apr 12
    {
        'id': 'TCB-20260412-0001', 'lineUserId': '', 'applicantName': '余謙',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 43, 'occupation': '教師', 'jobTitle': '高中老師', 'income': 75000, 'purpose': '裝潢修繕', 'termYears': 5, 'amount': 500000},
        'propertyInfo': None, 'recommendedProductId': 'civil-servant-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'pending', 'appliedAt': '2026-04-12T10:15:00.000Z',
    },
    {
        'id': 'TCB-20260412-0002', 'lineUserId': '', 'applicantName': '鄧愷威',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 48, 'occupation': '自營商', 'jobTitle': '診所院長', 'income': 250000, 'purpose': '投資理財', 'termYears': 15, 'amount': 18000000},
        'propertyInfo': {'propertyAge': 20, 'areaPing': 78.0, 'hasParking': True, 'layout': '5房3廳3衛', 'floor': 2, 'buildingType': '透天厝'},
        'recommendedProductId': 'general-mortgage',
        'mydataReady': False, 'landRegistryReady': True,
        'status': 'reviewing', 'appliedAt': '2026-04-12T16:08:44.000Z',
    },
    # Apr 14
    {
        'id': 'TCB-20260414-0001', 'lineUserId': '', 'applicantName': '朱育賢',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 31, 'occupation': '上班族', 'jobTitle': '行銷專員', 'income': 50000, 'purpose': '資金周轉', 'termYears': 5, 'amount': 400000},
        'propertyInfo': None, 'recommendedProductId': 'general-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'pending', 'appliedAt': '2026-04-14T09:20:00.000Z',
    },
    {
        'id': 'TCB-20260414-0002', 'lineUserId': '', 'applicantName': '曹錦輝',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 35, 'occupation': '公務員', 'jobTitle': '海巡員', 'income': 68000, 'purpose': '首購自住', 'termYears': 30, 'amount': 8500000},
        'propertyInfo': {'propertyAge': 1, 'areaPing': 29.5, 'hasParking': False, 'layout': '2房2廳1衛', 'floor': 4, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'young-safe-home',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'approved', 'appliedAt': '2026-04-14T14:55:38.000Z',
    },
    # Apr 15
    {
        'id': 'TCB-20260415-0001', 'lineUserId': '', 'applicantName': '吳念庭',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 27, 'occupation': '上班族', 'jobTitle': '設計師', 'income': 55000, 'purpose': '資金周轉', 'termYears': 3, 'amount': 300000},
        'propertyInfo': None, 'recommendedProductId': 'general-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'pending', 'appliedAt': '2026-04-15T11:00:00.000Z',
    },
    {
        'id': 'TCB-20260415-0002', 'lineUserId': '', 'applicantName': '廖任磊',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 42, 'occupation': '公務員', 'jobTitle': '消防員', 'income': 78000, 'purpose': '首購自住', 'termYears': 30, 'amount': 9500000},
        'propertyInfo': {'propertyAge': 4, 'areaPing': 33.0, 'hasParking': True, 'layout': '3房2廳2衛', 'floor': 7, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'young-safe-home',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'pending', 'appliedAt': '2026-04-15T15:30:00.000Z',
    },
    # Apr 17 今日 (2 additional, 陳偉殷 fixed from 04-18)
    {
        'id': 'TCB-20260417-0002', 'lineUserId': '', 'applicantName': '蔣少宏',
        'applicantPhone': '', 'loanType': 'personal',
        'basicInfo': {'age': 34, 'occupation': '上班族', 'jobTitle': '軟體工程師', 'income': 95000, 'purpose': '資金周轉', 'termYears': 5, 'amount': 600000},
        'propertyInfo': None, 'recommendedProductId': 'general-personal',
        'mydataReady': True, 'landRegistryReady': False,
        'status': 'pending', 'appliedAt': '2026-04-17T09:45:00.000Z',
    },
    {
        'id': 'TCB-20260417-0003', 'lineUserId': '', 'applicantName': '鄭凱文',
        'applicantPhone': '', 'loanType': 'mortgage',
        'basicInfo': {'age': 36, 'occupation': '上班族', 'jobTitle': '醫師', 'income': 200000, 'purpose': '首購自住', 'termYears': 30, 'amount': 16000000},
        'propertyInfo': {'propertyAge': 0, 'areaPing': 45.0, 'hasParking': True, 'layout': '3房2廳2衛', 'floor': 15, 'buildingType': '電梯大樓'},
        'recommendedProductId': 'young-safe-home',
        'mydataReady': True, 'landRegistryReady': True,
        'status': 'reviewing', 'appliedAt': '2026-04-17T11:20:00.000Z',
    },
]

all_cases = existing + new_cases
all_cases.sort(key=lambda c: c['appliedAt'])

with open('data/applications.json', 'w', encoding='utf-8') as f:
    json.dump(all_cases, f, ensure_ascii=False, indent=2)

from collections import Counter
status_count = Counter(c['status'] for c in all_cases)
print(f'Total cases: {len(all_cases)}')
print('Status:', dict(status_count))
approved = status_count.get('approved', 0)
total_decided = approved + status_count.get('rejected', 0)
print(f'核准率: {approved/total_decided*100:.0f}% ({approved}/{total_decided})')
dates = Counter(c['appliedAt'][:10] for c in all_cases)
for d, cnt in sorted(dates.items()):
    print(f'  {d}: {cnt} 件')
