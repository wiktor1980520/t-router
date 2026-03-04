package sms

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v3/client"
	util "github.com/alibabacloud-go/tea-utils/v2/service"
	"github.com/alibabacloud-go/tea/tea"
)

type AliyunProvider struct {
	client   *dysmsapi.Client
	signName string
}

func NewAliyunProvider() (*AliyunProvider, error) {
	accessKeyId := os.Getenv("ALIYUN_ACCESS_KEY_ID")
	accessKeySecret := os.Getenv("ALIYUN_ACCESS_KEY_SECRET")
	signName := os.Getenv("ALIYUN_SMS_SIGN_NAME")
	endpoint := os.Getenv("ALIYUN_SMS_ENDPOINT") // Optional, default is dysmsapi.aliyuncs.com

	if accessKeyId == "" || accessKeySecret == "" {
		return nil, fmt.Errorf("missing Aliyun credentials")
	}

	if signName == "" {
		return nil, fmt.Errorf("missing Aliyun SMS sign name")
	}

	config := &openapi.Config{
		AccessKeyId:     tea.String(accessKeyId),
		AccessKeySecret: tea.String(accessKeySecret),
	}
	
	if endpoint != "" {
		config.Endpoint = tea.String(endpoint)
	} else {
		config.Endpoint = tea.String("dysmsapi.aliyuncs.com")
	}

	client, err := dysmsapi.NewClient(config)
	if err != nil {
		return nil, err
	}

	return &AliyunProvider{
		client:   client,
		signName: signName,
	}, nil
}

func (p *AliyunProvider) Send(ctx context.Context, phone string, templateCode string, templateParams map[string]string) error {
	paramsJSON, err := json.Marshal(templateParams)
	if err != nil {
		return fmt.Errorf("failed to marshal template params: %w", err)
	}

	sendSmsRequest := &dysmsapi.SendSmsRequest{
		PhoneNumbers:  tea.String(phone),
		SignName:      tea.String(p.signName),
		TemplateCode:  tea.String(templateCode),
		TemplateParam: tea.String(string(paramsJSON)),
	}

	runtime := &util.RuntimeOptions{}
	
	resp, err := p.client.SendSmsWithOptions(sendSmsRequest, runtime)
	if err != nil {
		return err
	}

	if *resp.Body.Code != "OK" {
		return fmt.Errorf("aliyun sms error: %s - %s", *resp.Body.Code, *resp.Body.Message)
	}

	return nil
}
